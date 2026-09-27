import { notFound } from "next/navigation";
import { WorkspaceLoader } from "@/components/ClientOnly";
import { getProblem, PROBLEMS } from "@/lib/problems";

export function generateStaticParams() {
  return PROBLEMS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/problems/[slug]">) {
  const { slug } = await params;
  const problem = getProblem(slug);
  return { title: problem ? `${problem.title} · ArchFlow` : "ArchFlow" };
}

export default async function ProblemPage({ params }: PageProps<"/problems/[slug]">) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();
  return <WorkspaceLoader problem={problem} />;
}
