import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const ADMIN = "00110000-0000-4000-8000-000000000001",
  MEMBER = "00110000-0000-4000-8000-000000000002";
let image: string, chain: string, model: string;
async function session(
  user = ADMIN,
  provider = "google",
  role = "authenticated",
) {
  await db.exec("reset role");
  await db.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [user, JSON.stringify({ app_metadata: { provider } })],
  );
  await db.exec(`set role ${role}`);
}
async function detail(id = chain) {
  return (
    await db.query<{
      value: {
        revision: number;
        steps: { id: string; position: number; name: string }[];
      };
    }>("select public.punnett_studio_chain($1) value", [id])
  ).rows[0].value;
}
async function mutate(
  op: string,
  payload: unknown = {},
  id: string | null = chain,
  rev?: number,
) {
  return (
    await db.query<{ id: string }>(
      "select public.punnett_studio_mutate($1,$2,$3,$4::jsonb) id",
      [
        op,
        id,
        rev ?? (id ? (await detail(id)).revision : null),
        JSON.stringify(payload),
      ],
    )
  ).rows[0].id;
}
before(async () => {
  for (const file of [
    "../tests/fixtures/schema.sql",
    "../docs/w6-admin.sql",
    "../docs/w7-domain.sql",
  ])
    await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2)", [ADMIN, MEMBER]);
  await db.query(
    "insert into public.profiles(id,is_superadmin) values($1,true),($2,false)",
    [ADMIN, MEMBER],
  );
  image = (
    await db.query<{ id: string }>(
      "insert into public.punnett_images(owner_id,mime_type,storage_path) values($1,'image/jpeg','fixture/image.jpg') returning id",
      [ADMIN],
    )
  ).rows[0].id;
  await db.query(
    "insert into public.punnett_generations(image_id,owner_id,prompt,model,status) values($1,$2,'Fixture prompt','gemini-3.5-flash-lite','completed')",
    [image, ADMIN],
  );
  await db.exec(
    await readFile(
      new URL("../docs/prompt-studio.sql", import.meta.url),
      "utf8",
    ),
  );
  model = (
    await db.query<{ id: string }>(
      "select id from punnett_private.w7_models limit 1",
    )
  ).rows[0].id;
  chain = (
    await db.query<{ id: string }>(
      "select id from punnett_private.studio_chains where name='Image to punchline'",
    )
  ).rows[0].id;
  await session();
});
after(async () => db.close());
test("all studio operations deny anonymous, ordinary members, and non-Google admin contexts", async () => {
  for (const [user, provider, role] of [
    ["", "google", "anon"],
    [MEMBER, "google", "authenticated"],
    [ADMIN, "email", "authenticated"],
  ]) {
    await session(user, provider, role);
    for (const query of [
      "select * from public.punnett_studio_page('chains')",
      `select public.punnett_studio_chain('${chain}')`,
      "select public.punnett_studio_mutate('chain.create',null,null,'{\"name\":\"Denied\"}')",
      `select public.punnett_studio_begin('${chain}','${image}',gen_random_uuid())`,
      `select public.punnett_studio_checkpoint(gen_random_uuid(),1,'null',1)`,
      `select public.punnett_studio_fail(gen_random_uuid(),'Denied')`,
    ])
      await assert.rejects(db.query(query), { code: "42501" });
    await assert.rejects(
      db.query("select * from punnett_private.studio_chains"),
      { code: "42501" },
    );
  }
  await session();
});
test("chain and step CRUD, contiguous reordering, stale-write protection, and cross-chain isolation", async () => {
  const id = await mutate(
    "chain.create",
    { name: "Test chain", description: "Fixture" },
    null,
  );
  const fields = {
    name: "First",
    system_prompt: "Test",
    user_prompt: "Describe",
    input_kind: "image",
    output_kind: "text",
    model_id: model,
    temperature: 0.5,
  };
  await mutate("step.create", fields, id);
  await mutate(
    "step.create",
    {
      ...fields,
      name: "Second",
      input_kind: "previous",
      output_kind: "captions",
    },
    id,
  );
  const before = await detail(id),
    [first, second] = before.steps;
  await mutate("step.move", { step_id: second.id, position: 1 }, id);
  assert.deepEqual(
    (await detail(id)).steps.map((s) => [s.name, s.position]),
    [
      ["Second", 1],
      ["First", 2],
    ],
  );
  await assert.rejects(
    mutate(
      "step.move",
      { step_id: second.id, position: 2 },
      id,
      before.revision,
    ),
    { code: "40001" },
  );
  await assert.rejects(mutate("step.delete", { step_id: first.id }, chain), {
    code: "40001",
  });
  await mutate(
    "step.update",
    { ...fields, name: "Edited", step_id: first.id },
    id,
  );
  await mutate("step.delete", { step_id: second.id }, id);
  assert.deepEqual(
    (await detail(id)).steps.map((s) => [s.name, s.position]),
    [["Edited", 1]],
  );
  await mutate(
    "chain.update",
    { name: "Updated chain", description: "Saved", weight: 2 },
    id,
  );
  await mutate("chain.delete", {}, id);
  assert.equal(await detail(id), null);
});
test("run snapshots preserve exact prompts after edits and deletion; checkpoints persist in sequence", async () => {
  const request = crypto.randomUUID();
  const result = (
    await db.query<{
      value: { id: string; snapshot: { name: string; steps: unknown[] } };
    }>("select public.punnett_studio_begin($1,$2,$3) value", [
      chain,
      image,
      request,
    ])
  ).rows[0].value;
  assert.equal(result.snapshot.steps.length, 3);
  await assert.rejects(
    db.query("select public.punnett_studio_begin($1,$2,$3)", [
      chain,
      image,
      request,
    ]),
    { code: "23505" },
  );
  await assert.rejects(
    db.query("select public.punnett_studio_checkpoint($1,2,$2::jsonb,10)", [
      result.id,
      JSON.stringify("Wrong order"),
    ]),
    { code: "23514" },
  );
  await db.query("select public.punnett_studio_checkpoint($1,1,$2::jsonb,10)", [
    result.id,
    JSON.stringify(
      "A real provider description would be recorded here; isolated fixture only.",
    ),
  ]);
  await db.query("select public.punnett_studio_checkpoint($1,2,$2::jsonb,20)", [
    result.id,
    JSON.stringify("Fixture comic angle"),
  ]);
  await assert.rejects(
    db.query("select public.punnett_studio_checkpoint($1,3,$2::jsonb,30)", [
      result.id,
      JSON.stringify(["same", "Same"]),
    ]),
    { code: "23514" },
  );
  await db.query("select public.punnett_studio_checkpoint($1,3,$2::jsonb,30)", [
    result.id,
    JSON.stringify(["Fixture one", "Fixture two"]),
  ]);
  const run = (
    await db.query<{
      record: {
        status: string;
        outputs: unknown[];
        snapshot: { name: string };
      };
    }>("select record from public.punnett_studio_page('runs') where id=$1", [
      result.id,
    ])
  ).rows[0].record;
  assert.equal(run.status, "completed");
  assert.equal(run.outputs.length, 3);
  assert.equal(run.snapshot.name, result.snapshot.name);
  await assert.rejects(
    db.query("select public.punnett_studio_checkpoint($1,3,$2::jsonb,30)", [
      result.id,
      JSON.stringify(["again", "again2"]),
    ]),
    { code: "40001" },
  );
  const removable = await mutate(
    "chain.create",
    { name: "Delete with run" },
    null,
  );
  await mutate(
    "step.create",
    {
      name: "Captions",
      system_prompt: "",
      user_prompt: "Write captions",
      input_kind: "image",
      output_kind: "captions",
      model_id: model,
      temperature: 0.5,
    },
    removable,
  );
  const run2 = (
    await db.query<{ value: { id: string } }>(
      "select public.punnett_studio_begin($1,$2,gen_random_uuid()) value",
      [removable, image],
    )
  ).rows[0].value.id;
  await db.query("select public.punnett_studio_fail($1,$2)", [
    run2,
    "Fixture failure",
  ]);
  await mutate("chain.delete", {}, removable);
  assert.equal(
    (
      await db.query<{
        record: { chain_id: null; snapshot: { name: string } };
      }>("select record from public.punnett_studio_page('runs') where id=$1", [
        run2,
      ])
    ).rows[0].record.snapshot.name,
    "Delete with run",
  );
});
test("pagination covers 1,203 real fixture rows without truncation, including final and oversized pages", async () => {
  await db.exec("reset role");
  await db.exec(
    "insert into punnett_private.studio_chains(name,description) select 'Volume fixture '||lpad(i::text,4,'0'),'Pagination fixture only' from generate_series(1,1203) i",
  );
  await session();
  const read = async (limit: number, offset: number) =>
    (
      await db.query<{ id: string }>(
        "select id from public.punnett_studio_page('chains','Volume fixture') limit $1 offset $2",
        [limit, offset],
      )
    ).rows;
  const ids = [];
  for (let offset = 0; offset < 1203; offset += 200)
    ids.push(...(await read(200, offset)).map((r) => r.id));
  assert.equal(new Set(ids).size, 1203);
  assert.equal((await read(25, 0)).length, 25);
  assert.equal((await read(25, 600)).length, 25);
  assert.equal((await read(25, 1200)).length, 3);
  assert.equal((await read(2000, 0)).length, 1203);
});
