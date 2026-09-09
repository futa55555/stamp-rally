import axios from 'axios';
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}
export function apiError(error: unknown): Error {
  if (axios.isCancel(error) || error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.message;
    const message =
      status === 404
        ? '対象が見つかりません。削除されたか、アクセスできない可能性があります。'
        : status === 401
          ? 'ログインし直してください。'
          : !status
            ? '通信できませんでした。接続を確認して再試行してください。'
            : Array.isArray(detail)
              ? detail.join('\n')
              : typeof detail === 'string'
                ? detail
                : '操作に失敗しました。再試行してください。';
    return new ApiError(message, status);
  }
  return error instanceof Error ? error : new ApiError('操作に失敗しました。');
}

export function shouldRetry(failureCount: number, error: Error) {
  return (
    failureCount < 2 &&
    !axios.isCancel(error) &&
    (!(error instanceof ApiError) || !error.status || error.status >= 500)
  );
}
