import type { RestResponse } from '~/app/rest/actions';
import { CodeEditor } from '~/widgets/codeEditor/editor';
import styles from './response.module.css';

interface ResponseViewerProps {
  dict: Record<string, string>;
  response: RestResponse;
}

export function ResponseViewer({ dict, response }: ResponseViewerProps) {
  const { data, status, message, contentType, lapse } = response;
  const contentTypeStr = contentType?.split(';')[0];

  return (
    <section className={styles.response} aria-label="response">
      <div className={styles.response__controls}>
        <h3>{dict.response}</h3>
        {status && (
          <div className={styles.response__status}>
            <span>{status}</span>
            <span style={{ color: status === 200 ? 'green' : 'unset' }}>{message}</span>
            <span>{contentTypeStr}</span>
            <span style={{ color: lapse < 2500 ? 'green' : 'red' }}>{`${lapse}ms`}</span>
          </div>
        )}
      </div>
      <CodeEditor name="response" data={data ?? message ?? ''} readonly prettify />
    </section>
  );
}
