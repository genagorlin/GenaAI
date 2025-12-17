import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Trash2, FileText, Image, File, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "./ObjectUploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface FileAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  objectPath: string;
  createdAt: string;
}

interface FileAttachmentsProps {
  exerciseId?: string;
  referenceDocumentId?: string;
  showUpload?: boolean;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-4 w-4" />;
  }
  if (mimeType === "application/pdf" || mimeType.includes("document") || mimeType.includes("text")) {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function FileAttachments({ 
  exerciseId, 
  referenceDocumentId, 
  showUpload = true 
}: FileAttachmentsProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const queryKey = exerciseId 
    ? [`/api/coach/exercises/${exerciseId}/files`]
    : [`/api/coach/reference-documents/${referenceDocumentId}/files`];

  const { data: attachments = [], isLoading } = useQuery<FileAttachment[]>({
    queryKey,
    enabled: !!(exerciseId || referenceDocumentId),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/coach/files/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete file");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("File removed");
    },
    onError: () => {
      toast.error("Failed to remove file");
    },
  });

  const handleUploadComplete = async (result: any) => {
    const uploadedFiles = result.successful || [];
    
    for (const file of uploadedFiles) {
      try {
        const response = await fetch("/api/coach/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.meta?.name || file.name,
            originalName: file.meta?.name || file.name,
            mimeType: file.type,
            size: file.size,
            objectPath: file.response?.body?.path || file.uploadURL?.split("?")[0],
            exerciseId: exerciseId || null,
            referenceDocumentId: referenceDocumentId || null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save file metadata");
        }
      } catch (error) {
        console.error("Error saving file:", error);
        toast.error(`Failed to save ${file.name}`);
      }
    }

    queryClient.invalidateQueries({ queryKey });
    setIsUploading(false);
    toast.success(`${uploadedFiles.length} file(s) uploaded`);
  };

  const getUploadUrl = async () => {
    const res = await fetch("/api/coach/files/upload-url", { method: "POST" });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const data = await res.json();
    return { method: "PUT" as const, url: data.uploadURL };
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading files...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </span>
        {showUpload && (
          <ObjectUploader
            maxNumberOfFiles={5}
            maxFileSize={20 * 1024 * 1024}
            onGetUploadParameters={getUploadUrl}
            onComplete={handleUploadComplete}
            buttonVariant="outline"
            buttonClassName="h-7 text-xs"
          >
            Add File
          </ObjectUploader>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="space-y-1 border rounded-md p-2 bg-muted/30">
          {attachments.map((file) => (
            <div 
              key={file.id} 
              className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted"
            >
              {getFileIcon(file.mimeType)}
              <span className="flex-1 truncate" title={file.originalName}>
                {file.originalName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    data-testid={`delete-file-${file.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Attachment</AlertDialogTitle>
                    <AlertDialogDescription>
                      Remove "{file.originalName}" from this item?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(file.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {attachments.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No files attached. Upload PDFs, documents, or images for the AI to reference.
        </p>
      )}
    </div>
  );
}
