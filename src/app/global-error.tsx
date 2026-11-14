"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return <html lang="vi"><body><main className="global-error"><span>GiaPhaVN</span><h1>Đã có lỗi ngoài dự kiến</h1><p>Thông tin kỹ thuật đã được ghi nhận. Bạn có thể thử tải lại thao tác.</p><button className="button button-primary" onClick={reset}>Thử lại</button></main></body></html>;
}

