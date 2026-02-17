import CheckinClient from "@/app/checkin-client";

export default function SharePage({
  params,
}: {
  params: { token: string };
}) {
  return <CheckinClient mode="shared" ownerToken={params.token} />;
}
