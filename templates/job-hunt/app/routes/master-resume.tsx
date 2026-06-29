import { useState } from "react";
import { useActionQuery, useActionMutation } from "@agent-native/core/client";
import { toast } from "sonner";
import { Link } from "react-router";
import {
  IconArrowLeft,
  IconBriefcase,
  IconEye,
  IconEyeOff,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

interface ResumeSections {
  header?: string | null;
  pvp?: string | null;
  coreCompetencies?: string | null;
  skills?: string | null;
  experience?: string | null;
}

interface UpsertResult {
  ok: boolean;
  reason?: string;
  tokenCount?: number;
  unknown?: string[];
  saved?: boolean;
}

const SECTION_FIELDS: Array<{
  key: keyof ResumeSections;
  label: string;
  hint: string;
}> = [
  {
    key: "header",
    label: "Header",
    hint: "Pre-tokenize PII: ⟦NAME⟧, ⟦EMAIL⟧, ⟦PHONE⟧, ⟦ADDRESS⟧, ⟦LINKS⟧",
  },
  { key: "pvp", label: "PVP", hint: "Professional Value Proposition" },
  { key: "coreCompetencies", label: "Core Competencies", hint: "" },
  { key: "skills", label: "Skills", hint: "" },
  {
    key: "experience",
    label: "Experience",
    hint: "Keep employer names & dates real",
  },
];

export function meta() {
  return [{ title: "Master resume · Job Hunt" }];
}

export default function MasterResumeRoute() {
  const { data: resumeData } = useActionQuery<{
    resume: ResumeSections | null;
  }>("get-master-resume");
  const { data: vaultData } = useActionQuery<{
    tokens: Array<{ token: string; realValue: string }>;
  }>("manage-pii-tokens", { action: "list" });

  const upsert = useActionMutation<UpsertResult>("upsert-master-resume");
  const manageTokens = useActionMutation("manage-pii-tokens");

  const resume = resumeData?.resume ?? null;
  const tokens = vaultData?.tokens ?? [];

  const [raw, setRaw] = useState("");
  const [sections, setSections] = useState<ResumeSections>({});
  const [revealVault, setRevealVault] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [newValue, setNewValue] = useState("");

  // Keep section form in sync once the resume loads.
  if (resume && sections.header === undefined && raw === "") {
    setSections({
      header: resume.header ?? "",
      pvp: resume.pvp ?? "",
      coreCompetencies: resume.coreCompetencies ?? "",
      skills: resume.skills ?? "",
      experience: resume.experience ?? "",
    });
  }

  const handleParseSave = async () => {
    if (!raw.trim()) {
      toast.error("Paste your resume first.");
      return;
    }
    const res = await upsert.mutateAsync({ raw });
    if (!res.ok) {
      toast.error(res.reason ?? "Header is not tokenized correctly.");
      return;
    }
    toast.success(`Saved. ${res.tokenCount ?? 0} token(s) detected in header.`);
    setRaw("");
  };

  const handleSectionsSave = async () => {
    const res = await upsert.mutateAsync({ sections });
    if (!res.ok) {
      toast.error(res.reason ?? "Header is not tokenized correctly.");
      return;
    }
    toast.success("Sections saved.");
  };

  const handleAddToken = async () => {
    if (!newToken.trim() || !newValue.trim()) {
      toast.error("Add both a token and its real value.");
      return;
    }
    await manageTokens.mutateAsync({
      action: "add",
      token: newToken,
      realValue: newValue,
    });
    setNewToken("");
    setNewValue("");
    toast.success("Token added to your local PII vault.");
  };

  const handleRemoveToken = async (token: string) => {
    await manageTokens.mutateAsync({ action: "remove", token });
    toast.success("Token removed.");
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <IconBriefcase className="h-6 w-6 text-primary" />
              Master resume
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Baseline for ATS matching and resume tailoring.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <IconArrowLeft className="h-4 w-4" />
              Back to board
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resume</CardTitle>
            <CardDescription>
              Split into Header, PVP, Core Competencies, Skills, Experience. The
              Header must be Tier-1 tokenized — real values go in the PII vault
              below, never here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="paste">
              <TabsList>
                <TabsTrigger value="paste">Paste resume</TabsTrigger>
                <TabsTrigger value="sections">Edit sections</TabsTrigger>
              </TabsList>

              <TabsContent value="paste" className="space-y-3">
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={`# Header\n⟦NAME⟧ · ⟦EMAIL⟧ · ⟦PHONE⟧ · ⟦LINKS⟧\n\n# PVP\n...\n\n# Core Competencies\n...\n\n# Skills\n...\n\n# Experience\nSenior Engineer, Acme — 2021–now\n...`}
                  className="min-h-[280px] font-mono text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <Button onClick={handleParseSave} disabled={upsert.isPending}>
                    {upsert.isPending ? "Parsing…" : "Parse & save"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!raw.trim()) {
                        toast.error("Paste your resume first.");
                        return;
                      }
                      const res = await upsert.mutateAsync({
                        raw,
                        validateOnly: true,
                      });
                      if (res.ok)
                        toast.success(
                          `Header OK — ${res.tokenCount ?? 0} token(s).`,
                        );
                      else toast.error(res.reason ?? "Header not valid.");
                    }}
                  >
                    Validate only
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="sections" className="space-y-4">
                {SECTION_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={f.key}>
                      {f.label}
                      {f.hint ? (
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {f.hint}
                        </span>
                      ) : null}
                    </Label>
                    <Textarea
                      id={f.key}
                      value={(sections[f.key] as string) ?? ""}
                      onChange={(e) =>
                        setSections((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                      className="min-h-[100px] font-mono text-[13px]"
                    />
                  </div>
                ))}
                <Button
                  onClick={handleSectionsSave}
                  disabled={upsert.isPending}
                >
                  {upsert.isPending ? "Saving…" : "Save sections"}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>PII vault</CardTitle>
                <CardDescription>
                  Real values for your ⟦TOKEN⟧ entries. Stored locally only —
                  never sent to the LLM. Used to re-inject your details into
                  final documents.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRevealVault((v) => !v)}
                title={revealVault ? "Hide values" : "Reveal values"}
              >
                {revealVault ? (
                  <IconEyeOff className="h-4 w-4" />
                ) : (
                  <IconEye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {tokens.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tokens yet. Add your header tokens, e.g.{" "}
                  <code className="text-[12px] bg-muted px-1 py-0.5 rounded">
                    ⟦NAME⟧
                  </code>{" "}
                  → your real name.
                </p>
              ) : (
                tokens.map((t) => (
                  <div
                    key={t.token}
                    className="flex items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <code className="text-[12px] bg-muted px-1.5 py-0.5 rounded">
                      {t.token}
                    </code>
                    <span className="text-sm flex-1 truncate font-mono">
                      {revealVault
                        ? t.realValue
                        : "•".repeat(Math.min(12, t.realValue.length))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveToken(t.token)}
                      title="Remove token"
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="new-token">Token</Label>
                <Input
                  id="new-token"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                  placeholder="⟦NAME⟧"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-value">Real value</Label>
                <Input
                  id="new-value"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <Button
                onClick={handleAddToken}
                disabled={manageTokens.isPending}
              >
                <IconPlus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
