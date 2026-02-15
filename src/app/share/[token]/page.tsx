import CheckinLoader from "@/app/checkin-loader";

export default function SharePage({ params }: { params: { token: string } }) {
  return <CheckinLoader mode="shared" ownerToken={params.token} />;
}
