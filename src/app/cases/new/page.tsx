import { NewCaseWizard } from "@/components/new-case-wizard";

export const runtime = "nodejs";

export default function NewCasePage(): React.JSX.Element {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <NewCaseWizard />
    </main>
  );
}
