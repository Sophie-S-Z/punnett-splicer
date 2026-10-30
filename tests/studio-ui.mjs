// Isolated production-built UI fixture. No real user, model call, or database mutation.
// Actual page/forms are copied; only auth/data transport and actions use fixture files.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
const root = process.cwd(),
  folder = resolve(".vercel/studio-ui-harness"),
  port = 3114;
async function write(name, text) {
  await mkdir(resolve(folder, name, ".."), { recursive: true });
  await writeFile(resolve(folder, name), text);
}
const chainId = "00110000-0000-4000-8000-000000000001",
  modelId = "00110000-0000-4000-8000-000000000002";
const step = {
  name: "Describe",
  system_prompt: "Fixture system prompt",
  user_prompt: "Fixture user prompt",
  input_kind: "image",
  output_kind: "text",
  model_id: modelId,
  model: "gemini-3.5-flash-lite",
  provider: "Google Gemini",
  temperature: 0.7,
};
const chain = {
  id: chainId,
  name: "Fixture chain",
  description: "Isolated UI fixture only",
  example: true,
  weight: 1,
  revision: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  steps: [
    { ...step, id: crypto.randomUUID(), position: 1 },
    {
      ...step,
      name: "Caption draft",
      input_kind: "previous",
      output_kind: "captions",
      id: crypto.randomUUID(),
      position: 2,
    },
  ],
};
await write("state.json", JSON.stringify([chain]));
await write("package.json", JSON.stringify({ private: true, type: "module" }));
await write(
  "next.config.mjs",
  `export default {outputFileTracingRoot:${JSON.stringify(root)},devIndicators:false};`,
);
await write(
  "tsconfig.json",
  JSON.stringify({
    extends: "../../tsconfig.json",
    compilerOptions: { paths: { "@/*": ["../../src/*"] } },
    include: ["**/*.tsx", "**/*.ts"],
    exclude: ["node_modules"],
  }),
);
for (const name of ["StudioPage", "StudioForms", "RunPanel"]) {
  let source = await readFile(
    resolve(root, `src/components/${name}.tsx`),
    "utf8",
  );
  source = source
    .replace('"@/lib/admin"', '"./fixture-admin"')
    .replace('"@/app/studio-actions"', '"./stub-actions"');
  for (const component of ["Shell", "RecordImage"])
    source = source.replace(`"./${component}"`, `"@/components/${component}"`);
  await write(`${name}.tsx`, source);
}
const statePath = JSON.stringify(resolve(folder, "state.json"));
await write(
  "fixture-admin.ts",
  `// @ts-nocheck
import {readFile} from 'node:fs/promises';export async function requireAdmin():Promise<any>{return {client:{rpc(name,args){const load=async()=>JSON.parse(await readFile(${statePath},'utf8'));if(name==='punnett_studio_chain')return load().then(rows=>({data:rows.find(c=>c.id===args.id_input)??null,error:null}));return {range:async(a,b)=>{let rows=[];if(name==='punnett_studio_page'&&args.kind_input==='chains'){rows=(await load()).filter(c=>!args.search_input||c.name.includes(args.search_input)).map(c=>({id:c.id,record:{...c,step_count:c.steps.length}}));}else if(name==='punnett_admin_records'&&args.kind_input==='models')rows=[{record:{id:'${modelId}',name:'gemini-3.5-flash-lite'}}];return {data:rows.slice(a,b+1),count:rows.length,error:null,status:200};}};}}};}
`,
);
await write(
  "stub-actions.ts",
  `// @ts-nocheck
'use server';
import {readFile,writeFile} from 'node:fs/promises';import {studioInput} from '@/lib/studio';
export async function editStudio(operation:string,form:FormData):Promise<any>{const {payload,error}=studioInput(operation,form);if(error)return {ok:false,message:error};let rows=JSON.parse(await readFile(${statePath},'utf8'));let id=String(form.get('chain_id'));let chain=rows.find(c=>c.id===id);if(operation==='chain.create'){id=crypto.randomUUID();rows.push({id,...payload,weight:0,revision:1,example:false,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),steps:[]});}else {if(!chain||chain.revision!==Number(form.get('revision')))return {ok:false,message:'This chain changed in another tab. Reload before saving.'};if(operation==='chain.delete')rows=rows.filter(c=>c.id!==id);else if(operation==='chain.update')Object.assign(chain,payload);else if(operation==='step.create')chain.steps.push({...payload,id:crypto.randomUUID(),position:chain.steps.length+1,model:'gemini-3.5-flash-lite',provider:'Google Gemini'});else {const index=chain.steps.findIndex(s=>s.id===payload.step_id);if(index<0)return {ok:false,message:'Step unavailable'};if(operation==='step.delete')chain.steps.splice(index,1);if(operation==='step.update')Object.assign(chain.steps[index],payload);if(operation==='step.move'){const [step]=chain.steps.splice(index,1);chain.steps.splice(Number(payload.position)-1,0,step);}chain.steps.forEach((s,i)=>s.position=i+1);}chain.revision++;}await writeFile(${statePath},JSON.stringify(rows));return {ok:true,id,message:'Fixture saved'};}
export async function runStudio(_form:FormData):Promise<any>{return {ok:false,message:'Fixture only: no provider call was made.'};}
`,
);
await write(
  "app/layout.tsx",
  `import '../../../src/app/globals.css';export const metadata={title:'Prompt studio isolated UI fixture'};export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" data-theme="night"><body>{children}</body></html>}`,
);
for (const route of ["chains", "mix", "runs"])
  await write(
    `app/${route}/page.tsx`,
    `import {StudioPage} from '../../StudioPage';export const dynamic='force-dynamic';export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <StudioPage query={await searchParams} mode="${route === "mix" ? "mix" : route === "runs" ? "runs" : "chains"}"/>;}`,
  );
await write(
  "playwright.config.ts",
  `import {defineConfig} from '@playwright/test';export default defineConfig({testDir:'./specs',workers:1,timeout:120000,expect:{timeout:15000},reporter:'list',outputDir:${JSON.stringify(resolve(root, "test-results/studio-ui"))},use:{baseURL:'http://127.0.0.1:${port}',channel:'chrome',headless:true}});`,
);
await write(
  "specs/studio.spec.ts",
  `import {test,expect} from '@playwright/test';import AxeBuilder from '@axe-core/playwright';
test('actual prompt page and forms: edit, reorder, mix, create/delete steps/chains, keyboard navigation and responsive accessibility',async({page})=>{
await page.goto('/chains');await page.getByRole('button',{name:'Edit step 1',exact:true}).click();await page.getByLabel('User prompt *',{exact:true}).fill('Updated prompt fixture');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.locator('.prompt-text')).toContainText(['Updated prompt fixture','Fixture user prompt']);
await page.getByRole('button',{name:'Move Describe down',exact:true}).click();await expect(page.locator('.step-card h3')).toHaveText(['Caption draft','Describe']);await page.reload();await expect(page.locator('.step-card h3')).toHaveText(['Caption draft','Describe']);await page.getByRole('button',{name:'Move Describe up',exact:true}).click();await expect(page.locator('.step-card h3')).toHaveText(['Describe','Caption draft']);
await page.getByRole('button',{name:'Edit chain',exact:true}).click();await page.getByLabel('Mix weight *',{exact:true}).fill('3');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.locator('.chain-card')).toContainText('weight 3');
await page.getByRole('button',{name:'Create prompt chain',exact:true}).click();await page.getByLabel('Name *',{exact:true}).fill('New fixture chain');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.getByRole('button',{name:'Add step',exact:true}).click();await page.getByLabel('Step name *',{exact:true}).fill('New caption step');await page.getByLabel('User prompt *',{exact:true}).fill('Write captions');await page.getByLabel('Output *',{exact:true}).selectOption('captions');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.locator('.step-card h3')).toHaveText(['New caption step']);
await page.getByRole('button',{name:'Delete step 1',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Delete step 1',exact:true})).toBeFocused();await page.getByRole('button',{name:'Delete step 1',exact:true}).click();await page.getByRole('button',{name:'Confirm delete',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.locator('.step-card')).toHaveCount(0);await page.getByRole('button',{name:'Delete chain',exact:true}).click();await page.getByRole('button',{name:'Confirm delete',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.chain-card')).toHaveCount(1);
await page.keyboard.press('Control+k');await expect(page.getByPlaceholder('Find a page or action…')).toBeVisible();await page.keyboard.press('Escape');
for(const width of [320,768,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(scan.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);}
});`,
);
const env = { ...process.env };
delete env.GEMINI_API_KEY;
async function processExit(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  return new Promise((resolveExit) => child.once("exit", resolveExit));
}
assert.equal(
  await processExit([
    resolve("node_modules/next/dist/bin/next"),
    "build",
    folder,
    "--webpack",
  ]),
  0,
);
const server = spawn(
  process.execPath,
  [
    resolve("node_modules/next/dist/bin/next"),
    "start",
    folder,
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { cwd: root, env, stdio: "ignore" },
);
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if (
        (
          await fetch(`http://127.0.0.1:${port}/chains`, {
            signal: AbortSignal.timeout(1000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Fixture did not start");
  assert.equal(
    await processExit([
      resolve("node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      resolve(folder, "playwright.config.ts"),
    ]),
    0,
  );
  console.log(
    "PASS: actual prompt UI fixture. No provider call or real database mutation.",
  );
} finally {
  if (server.pid && server.exitCode === null)
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], {
      stdio: "ignore",
    });
}
