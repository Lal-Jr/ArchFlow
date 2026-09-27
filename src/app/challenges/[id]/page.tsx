import { notFound } from "next/navigation";
import { ChallengeLoader } from "@/components/ClientOnly";
import { CHALLENGES, getChallenge } from "@/lib/challenges";

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/challenges/[id]">) {
  const { id } = await params;
  const c = getChallenge(id);
  return { title: c ? `${c.title} · ArchFlow challenges` : "ArchFlow" };
}

export default async function ChallengePage({ params }: PageProps<"/challenges/[id]">) {
  const { id } = await params;
  if (!getChallenge(id)) notFound();
  return <ChallengeLoader id={id} />;
}
