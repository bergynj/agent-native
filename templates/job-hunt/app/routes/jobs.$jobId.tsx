import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  useActionQuery,
  useActionMutation,
  sendToAgentChat,
} from "@agent-native/core/client";
import { toast } from "sonner";
import {
  IconArrowLeft,
  IconBriefcase,
  IconCheck,
  IconExternalLink,
  IconPlayerPlay,
  IconTrash,
  IconSparkles,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  APPLY_TYPE_LABELS,
  JOB_STATUS_LABELS,
  type Job,
  type JobDocument,
  type JobResearch,
} from "@shared/types";

export function meta({ params }: { params: { jobId: string } }) {
  return [{ title: `Job · ${params.jobId.slice(0, 8)}` }];
}

function DocCard({
  doc,
  type,
  onDraft,
}: {
  doc: JobDocument | undefined;
  type: "cover_letter" | "resume_diff";
  onDraft: () => void;
}) {
  const title = type === "cover_letter" ? "Cover letter" : "Resume updates";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {doc ? (
            <Badge variant={doc.approved ? "success" : "secondary"}>
              {doc.approved ? "Approved" : "Draft"}
            </Badge>
          ) : (
            <Button size="sm" variant="outline" onClick={onDraft}>
              <IconSparkles className="h-4 w-4" />
              Draft now
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {doc ? (
          <pre className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans">
            {doc.content}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not drafted yet. Click <strong>Draft now</strong> to have the agent
            prepare this from the role research.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function JobDetailRoute() {
  const { jobId = "" } = useParams();
  const { data } = useActionQuery<{
    job: Job;
    research: JobResearch | null;
    documents: JobDocument[];
  }>("get-job", { jobId });

  const approve = useActionMutation("approve-documents");
  const markSubmitted = useActionMutation("mark-submitted");
  const updateStatus = useActionMutation("update-job-status");

  const job = data?.job;
  const research = data?.research;
  const documents = data?.documents ?? [];
  const cover = documents.find((d) => d.type === "cover_letter");
  const diff = documents.find((d) => d.type === "resume_diff");

  const [archiveOpen, setArchiveOpen] = useState(false);

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading job…</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <IconArrowLeft className="h-4 w-4" />
              Back to board
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const draftForRole = () =>
    sendToAgentChat({
      message: `Prepare the application package for the "${job.title}" role at ${job.company} (job id ${job.id}). Run ATS analysis if missing, gather company/role research, then draft a tailored cover letter and resume updates (Role headline, PVP, Core competencies/skills) using get-job-context, save them with draft-cover-letter and draft-resume-diff, and call finalize-documents. Do not apply.`,
      context: `Job: ${job.title} at ${job.company} — ${job.source} (${job.applyType})`,
      submit: true,
    });

  const handleApprove = async () => {
    await approve.mutateAsync({ jobId });
    toast.success("Package approved. Ready for self-submission.");
  };

  const handleSubmitted = async () => {
    await markSubmitted.mutateAsync({ jobId });
    toast.success("Marked as submitted.");
  };

  const handleArchive = async () => {
    await updateStatus.mutateAsync({ jobId, status: "archived" });
    setArchiveOpen(false);
    toast.success("Job archived.");
  };

  const jd = job.jdFull ?? job.jdSnippet ?? null;

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <IconArrowLeft className="h-4 w-4" />
            Back to board
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <IconBriefcase className="h-6 w-6 text-primary" />
              {job.title}
            </h1>
            <p className="text-muted-foreground">{job.company}</p>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge>{JOB_STATUS_LABELS[job.status]}</Badge>
              <Badge variant="outline">
                {APPLY_TYPE_LABELS[job.applyType]}
              </Badge>
              <Badge variant="outline" className="uppercase">
                {job.source}
              </Badge>
              {job.matchScore != null && (
                <Badge variant={job.matchScore > 80 ? "success" : "secondary"}>
                  {job.matchScore}% match
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {job.jobUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={job.jobUrl} target="_blank" rel="noopener noreferrer">
                  <IconExternalLink className="h-4 w-4" />
                  View posting
                </a>
              </Button>
            ) : null}
            {(job.status === "new" || job.status === "researched") &&
            (!cover || !diff) ? (
              <Button size="sm" onClick={draftForRole}>
                <IconPlayerPlay className="h-4 w-4" />
                Draft package
              </Button>
            ) : null}
            {job.status === "drafted" ? (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approve.isPending}
              >
                <IconCheck className="h-4 w-4" />
                Approve
              </Button>
            ) : null}
            {job.status === "ready" ? (
              <Button
                size="sm"
                onClick={handleSubmitted}
                disabled={markSubmitted.isPending}
              >
                <IconCheck className="h-4 w-4" />
                Mark submitted
              </Button>
            ) : null}
            {job.status !== "archived" ? (
              <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <IconTrash className="h-4 w-4" />
                    Archive
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Archive this role?</DialogTitle>
                    <DialogDescription>
                      Moves the job to archived. You can restore it later via
                      update-job-status. Documents are kept.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={handleArchive}
                      disabled={updateStatus.isPending}
                    >
                      Archive
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>

        {jd ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job description</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] pr-4">
                <pre className="text-[13px] leading-relaxed whitespace-pre-wrap font-sans">
                  {jd}
                </pre>
              </ScrollArea>
              {job.fetchStatus !== "ok" ? (
                <p className="text-xs text-muted-foreground mt-2">
                  {job.fetchStatus === "snippet"
                    ? "Showing the email snippet — the full JD couldn't be fetched (the posting may be auth-gated)."
                    : "JD fetch failed; showing snippet if available."}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No job description yet. Run fetch-full-jd or the daily search to
              hydrate it.
            </CardContent>
          </Card>
        )}

        {research ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Research</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {research.atsKeywords.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ATS keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {research.atsKeywords.map((k) => (
                      <Badge key={k} variant="outline">
                        {k}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {research.companyBackground ? (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Company background
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {research.companyBackground}
                    </p>
                  </div>
                </>
              ) : null}
              {research.roleNotes ? (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Role notes</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {research.roleNotes}
                    </p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocCard doc={cover} type="cover_letter" onDraft={draftForRole} />
          <DocCard doc={diff} type="resume_diff" onDraft={draftForRole} />
        </div>
      </div>
    </div>
  );
}
