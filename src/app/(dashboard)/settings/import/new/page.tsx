import { ImportWizard } from "@/components/domain/imports/import-wizard";

export default async function NewImportPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const type = params.type === "inquiry" ? "inquiry" : "contact";

  return (
    <div className="container py-8 max-w-5xl">
      <ImportWizard entityType={type} />
    </div>
  );
}
