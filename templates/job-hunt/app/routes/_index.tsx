import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useActionQuery, sendToAgentChat } from "@agent-native/core/client";
import {
  IconBriefcase,
  IconPlayerPlay,
  IconFileText,
  IconExternalLink,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  APPLY_TYPE_LABELS,
  JOB_STATUS_LABELS,
  MATCH_AUTO_THRESHOLD,
  type ApplyType,
  type Job,
  type JobStatus,
} from "@shared/types";

export function meta() {
  return [{ title: "Job Hunt" }];
}

const STATUS_COLUMNS: JobStatus[] = [
  "new",
  "researched",
  "drafted",
  "ready",
  "submitted",
];

const APPLY_TABS: Array<{ value: ApplyType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "easy_apply", label: "Easy Apply" },
  { value: "quick_apply", label: "Quick Apply" },
  { value: "standard", label: "Standard" },
];

function statusVariant(
  status: JobStatus,
): "default" | "secondary" | "success" | "warning" | "outline" {
  switch (status) {
    case "ready":
      return "success";
    case "submitted":
      return "secondary";
    case "drafted":
      return "warning";
    case "researched":
      return "default";
    default:
      return "outline";
  }
}

function applyVariant(t: ApplyType): "default" | "secondary" | "outline" {
  if (t === "easy_apply") return "default";
  if (t === "quick_apply") return "secondary";
  return "outline";
}

function MatchScore({ score }: { score: number | null | undefined }) {
  if (score == null)
    return <span className="text-xs text-muted-foreground">unscored</span>;
  const hot = score > MATCH_AUTO_THRESHOLD;
  return (
    <span
      className={`text-lg font-semibold tabular-nums ${
        hot ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
      }`}
    >
      {score}%
    </span>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md hover:border-primary/40 transition-all p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-tight truncate">{job.title}</p>
          <p className="text-sm text-muted-foreground truncate">
            {job.company}
          </p>
        </div>
        <MatchScore score={job.matchScore} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={statusVariant(job.status)}>
          {JOB_STATUS_LABELS[job.status]}
        </Badge>
        <Badge variant={applyVariant(job.applyType)}>
          {APPLY_TYPE_LABELS[job.applyType]}
        </Badge>
        <Badge variant="outline" className="uppercase">
          {job.source}
        </Badge>
        {job.fetchStatus === "snippet" ? (
          <Badge variant="outline">JD: snippet</Badge>
        ) : job.fetchStatus === "failed" ? (
          <Badge variant="outline">JD: failed</Badge>
        ) : null}
      </div>
    </Link>
  );
}

export default function IndexPage() {
  const { data } = useActionQuery<{ jobs: Job[] }>("list-jobs");
  const { data: resumeData } = useActionQuery<{ resume: unknown }>(
    "get-master-resume",
  );
  const [applyFilter, setApplyFilter] = useState<ApplyType | "all">("all");

  const jobs = data?.jobs ?? [];
  const hasResume = !!(resumeData?.resume as unknown);

  const grouped = useMemo(() => {
    const filtered = jobs.filter(
      (j) => applyFilter === "all" || j.applyType === applyFilter,
    );
    const map = new Map<JobStatus, Job[]>();
    for (const s of STATUS_COLUMNS) map.set(s, []);
    for (const j of filtered) {
      if (j.status === "archived") continue;
      map.get(j.status)?.push(j);
    }
    return map;
  }, [jobs, applyFilter]);

  const runSearch = () =>
    sendToAgentChat({
      message:
        "Run today's daily job search: fetch my latest LinkedIn and Seek job alert emails via call-agent to mail, then call run-daily-search with them, and draft cover letters + resume diffs for every auto-eligible role. Summarize what you found.",
      submit: true,
    });

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <IconBriefcase className="h-6 w-6 text-primary" />
              Job Hunt
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Daily shortlist, ATS analysis, and tailored drafts — you approve
              and self-submit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/master-resume">
                <IconFileText className="h-4 w-4" />
                Resume
              </Link>
            </Button>
            <Button size="sm" onClick={runSearch}>
              <IconPlayerPlay className="h-4 w-4" />
              Run today's search
            </Button>
          </div>
        </div>

        {!hasResume ? (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Upload your master resume first — it's the baseline for match
                scoring and tailoring.
              </p>
              <Button asChild size="sm">
                <Link to="/master-resume">Set up resume</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Tabs
          value={applyFilter}
          onValueChange={(v) => setApplyFilter(v as ApplyType | "all")}
        >
          <TabsList>
            {APPLY_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {STATUS_COLUMNS.map((status) => {
            const list = grouped.get(status) ?? [];
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {JOB_STATUS_LABELS[status]}
                  </h2>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {list.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground text-center">
                      No roles
                    </div>
                  ) : (
                    list.map((job) => <JobCard key={job.id} job={job} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <IconExternalLink className="h-3.5 w-3.5" />
          The agent never auto-applies. Drafts wait for your approval
          (drafted&nbsp;→&nbsp;ready&nbsp;→&nbsp;submitted).
        </p>
      </div>
    </div>
  );
}
