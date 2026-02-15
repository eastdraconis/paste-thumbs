import CheckinLoader from "@/app/checkin-loader";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <CheckinLoader mode="shared" ownerToken={token} />;
}
