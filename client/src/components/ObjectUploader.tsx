// Object Uploader Component
// Reference: javascript_object_storage blueprint

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "ghost" | "secondary";
  children: ReactNode;
}

export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760,
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          const params = await onGetUploadParameters();
          // Store the URL in file meta so we can access it after upload
          file.meta = { ...file.meta, uploadUrl: params.url };
          return params;
        },
      })
      .use(Dashboard, {
        inline: false,
        trigger: null,
        proudlyDisplayPoweredByUppy: false,
      })
  );

  useEffect(() => {
    const handleComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      // Attach the stored uploadUrl to each successful file
      const enhanced = {
        ...result,
        successful: result.successful?.map(file => ({
          ...file,
          uploadURL: (file.meta as any)?.uploadUrl?.split("?")[0] || file.uploadURL,
        })),
      };
      onComplete?.(enhanced);
      setShowModal(false);
      const dashboard = uppy.getPlugin('Dashboard');
      if (dashboard) {
        (dashboard as any).closeModal();
      }
    };

    uppy.on("complete", handleComplete);
    return () => {
      uppy.off("complete", handleComplete);
    };
  }, [uppy, onComplete]);

  useEffect(() => {
    const dashboard = uppy.getPlugin('Dashboard');
    if (dashboard) {
      if (showModal) {
        (dashboard as any).openModal();
      } else {
        (dashboard as any).closeModal();
      }
    }
  }, [showModal, uppy]);

  return (
    <div>
      <Button
        onClick={() => setShowModal(true)}
        className={buttonClassName}
        variant={buttonVariant}
      >
        {children}
      </Button>
    </div>
  );
}
