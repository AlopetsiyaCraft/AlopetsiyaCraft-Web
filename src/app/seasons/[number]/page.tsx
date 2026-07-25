import { redirect } from "next/navigation";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  redirect(`/seasons/${number}/map`);
}
