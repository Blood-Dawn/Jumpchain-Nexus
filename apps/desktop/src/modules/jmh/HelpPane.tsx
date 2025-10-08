/*
MIT License

Copyright (c) 2025 Age-Of-Ages

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { useJmhStore } from "./store";

interface HelpTopic {
  key: string;
  title: string;
}

const helpSources = import.meta.glob<string>("../../content/help/*.md", { query: "?raw", import: "default" });

const topics: HelpTopic[] = Object.keys(helpSources)
  .map((fullPath) => {
    const match = /([\w-]+)\.md$/i.exec(fullPath);
    const key = match ? match[1] : fullPath;
    const spaced = key
      .replace(/[-_]/g, " ")
      .replace(/([a-z])([A-Z])/g, (_, lower: string, upper: string) => `${lower} ${upper}`);
    const title = spaced.replace(/\b\w/g, (char) => char.toUpperCase());
    return { key, title } satisfies HelpTopic;
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export const HelpPane: React.FC = () => {
  const helpTopic = useJmhStore((state) => state.helpTopic);
  const setHelpTopic = useJmhStore((state) => state.setHelpTopic);
  const setHelpPaneOpen = useJmhStore((state) => state.setHelpPaneOpen);
  const [html, setHtml] = useState<string>("<p>Select a topic to learn more.</p>");

  const loader = useMemo(() => {
    const entry = topics.find((topic) => topic.title === helpTopic || topic.key === helpTopic);
    const key = entry?.key ?? helpTopic;
    return helpSources[`../../content/help/${key}.md`];
  }, [helpTopic]);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      const fn = loader;
      if (!fn) {
        setHtml("<p>Help content not found.</p>");
        return;
      }
      const markdown = await fn();
      if (cancelled) return;
      const rendered = await marked.parse(markdown);
      if (cancelled) return;
      setHtml(typeof rendered === "string" ? rendered : String(rendered));
    }
    load().catch((error) => {
      console.error("Failed to load help topic", error);
      setHtml("<p>Unable to load help content.</p>");
    });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return (
    <aside className="help-pane">
      <header className="help-pane__header">
        <div>
          <h2>Knowledge Base</h2>
          <p>Dive into mechanics, prep tips, and concepts.</p>
        </div>
        <button type="button" onClick={() => setHelpPaneOpen(false)}>
          Close
        </button>
      </header>
      <div className="help-pane__topics">
        {topics.map((topic) => (
          <button
            key={topic.key}
            type="button"
            className={topic.title === helpTopic || topic.key === helpTopic ? "active" : ""}
            onClick={() => setHelpTopic(topic.title)}
          >
            {topic.title}
          </button>
        ))}
      </div>
      <article className="help-pane__content" dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
};

export default HelpPane;
