'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RestResponse } from '~/app/rest/actions';
import { Loader } from '~/components/loader/loader';
import { Message } from '~/components/message/message';
import useHistory from '~/entities/useHistory';
import useVariables from '~/entities/useVariables';
import type { Locale } from '~/i18n-config';
import { debounce } from '~/utils/debounce';
import { getRequestUrlString, methods, type TMethod } from '~/utils/rest';
import { CodeEditor } from '~/widgets/codeEditor/editor';
import { CodeGenerator } from '~/widgets/codeGenerator/generator';
import HeadersEditor, { HeadersItem } from '~/widgets/headersEditor/editor';
import { ResponseViewer } from '~/widgets/response/response';

import { HeadersViewer } from '../headers/headers';
import { Tab, Tabs } from '../tabs/tabs';
import styles from './client.module.css';

type TQuery = { [key: string]: string | string[] | undefined };
interface RestClientProps {
  dict: Record<string, string>;
  locale: Locale;
  initMethod: TMethod;
  initUrl: string;
  initBody: string;
  initQuery: TQuery;
  response: RestResponse;
}
interface RestClientState {
  method: TMethod;
  url: string;
  body: string;
  headers: HeadersItem[];
}

const defaultHeader = { key: 'Content-type', value: 'application/json', enabled: true };

const getInitialHeaders = (query: TQuery) => {
  const headers = Object.entries(query).map(([key, value]) => ({ key, value: value?.toString() ?? '', enabled: true }));

  const knownHeaders: string[] = [];
  headers.filter(h => {
    const known = knownHeaders.includes(h.key);
    knownHeaders.push(h.key);
    return !known;
  });

  if (headers.findIndex(h => h.key === defaultHeader.key) === -1) {
    headers.unshift(defaultHeader);
  }

  return headers;
};

export default function RestClient({
  dict,
  locale,
  initUrl,
  initBody,
  initQuery,
  initMethod,
  response,
}: RestClientProps) {
  const { pushHistory } = useHistory();
  const { getVariables } = useVariables();
  const router = useRouter();
  const [headers, setHeaders] = useState<HeadersItem[]>(() => getInitialHeaders(initQuery));
  const [activeHeaders, setActiveHeaders] = useState<HeadersItem[]>(headers);
  const [activeUrl, setActiveUrl] = useState(initUrl);
  const [requestPath, setRequestPath] = useState('');
  const [state, setState] = useState<RestClientState>({
    method: initMethod,
    url: initUrl,
    body: initBody,
    headers: getInitialHeaders(initQuery),
  });
  const [stateWithVariables, setStateWithVariables] = useState<RestClientState>(state);
  const variables = useMemo(() => getVariables() ?? {}, [getVariables]);
  const debouncedUrl = useCallback(debounce(setActiveUrl), [setActiveUrl]);
  const debouncedHeaders = useCallback(debounce(setActiveHeaders), [setActiveHeaders]);

  const replaceVariables = useCallback(
    (value: string): string => {
      return value.replace(/\{\{([^\}]+)\}\}/g, (match, variable) => {
        return variables[variable] ?? match;
      });
    },
    [variables]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    Loader.show();
    debouncedUrl.cancel();
    debouncedHeaders.cancel();
    const actualUrl = replaceVariables(state.url);
    const actualHeaders = headers
      .filter(h => h.enabled && h.key && h.value)
      .map(({ key, value, enabled }) => ({ key, value: replaceVariables(value), enabled }));
    const data = {
      locale,
      method: state.method,
      url: actualUrl,
      body: replaceVariables(state.body),
      headers: actualHeaders,
    };

    pushHistory({
      date: Date.now(),
      method: state.method,
      url: state.url,
      linkToClient: getRequestUrlString(data),
    });
    router.push(getRequestUrlString(data));
  };

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState(prev => ({ ...prev, method: e.target.value as TMethod }));
  };

  const handleURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, url: e.target.value }));
    debouncedUrl(e.target.value);
  };

  const handleBodyChange = (body: string) => {
    setState(prev => ({ ...prev, body }));
  };

  useEffect(() => {
    debouncedHeaders(
      headers
        .filter(h => h.enabled && h.key && h.value)
        .map(({ key, value, enabled }) => ({ key, value: replaceVariables(value), enabled }))
    );
  }, [headers]);

  useEffect(() => {
    const data = {
      locale,
      method: state.method,
      url: replaceVariables(activeUrl),
      body: replaceVariables(state.body),
      headers: activeHeaders,
    };
    setRequestPath(getRequestUrlString(data));
    setStateWithVariables(data);
  }, [locale, state.method, state.body, activeUrl, activeHeaders, replaceVariables]);

  useEffect(() => {
    history.replaceState(null, '', requestPath);
  }, [requestPath]);

  useEffect(() => {
    Loader.hide();
    if (response.error) {
      Message.show(response.error, 'error');
    }
  }, [response]);

  useEffect(Loader.hide, []);

  return (
    <div className={styles.client}>
      <h1 className={styles.client__title}>{dict.title}</h1>
      <form onSubmit={handleSubmit} className={styles.client__form}>
        <div className={styles.client__req}>
          <select
            name="method"
            value={state.method}
            style={{ color: `var(--color-${state.method.toLowerCase()})` }}
            onChange={handleMethodChange}
            className={styles.client__method}
          >
            {methods.map(item => (
              <option key={item} value={item} style={{ color: `var(--color-${item.toLowerCase()})` }}>
                {item}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="url"
            value={state.url}
            onChange={handleURLChange}
            placeholder={dict.urlPlaceholder}
            className={styles.client__url}
          />
        </div>
        <button type="submit" className="button">
          {dict.send}
        </button>
      </form>
      <Tabs
        tabs={
          [
            {
              label: dict.headers,
              content: <HeadersEditor dict={dict} headers={headers} setHeaders={setHeaders} />,
            },
            ['POST', 'PUT', 'PATCH'].includes(state.method.toUpperCase())
              ? {
                  label: dict.body,
                  content: (
                    <section aria-label="body">
                      <h3 className={styles.client__section_title}>{dict.body}</h3>
                      <CodeEditor name="body" data={state.body} onBlur={handleBodyChange} />
                    </section>
                  ),
                }
              : null,
            {
              label: dict.response,
              content: response.data ? <ResponseViewer dict={dict} response={response} /> : dict.responseEmpty,
            },
            {
              label: dict.responseHeaders,
              content: response.headers ? (
                <HeadersViewer dict={dict} headers={response.headers} />
              ) : (
                dict.responseHeadersEmpty
              ),
            },
            {
              label: dict.code,
              content: <CodeGenerator dict={dict} data={stateWithVariables} />,
            },
          ].filter(Boolean) as Tab[]
        }
      />
    </div>
  );
}
