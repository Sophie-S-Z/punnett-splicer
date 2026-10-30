import { adminAccess } from "@/lib/admin";
import { UUID } from "@/lib/studio";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const access = await adminAccess();
  if (access.state !== "admin")
    return new Response(null, { status: 403, headers });
  const { id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404, headers });
  const { data: path, error } = await access.client.rpc(
    "punnett_admin_image_path",
    { id_input: id },
  );
  if (error || typeof path !== "string" || !path)
    return new Response(null, { status: 404, headers });
  const image = await access.client.storage
    .from("caption-images")
    .download(path);
  if (image.error || !image.data)
    return new Response(null, { status: 404, headers });
  return new Response(image.data, {
    headers: { ...headers, "Content-Type": "image/jpeg" },
  });
}
