import { StudioPage } from "@/components/StudioPage";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StudioPage query={await searchParams} mode="mix" />;
}
