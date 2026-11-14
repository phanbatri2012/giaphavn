"use client";

import { Bold, Italic, Link2, List, ListOrdered, Quote } from "lucide-react";
import { useRef, useState } from "react";

export function RichTextEditor({ name, initialHtml = "" }: { name: string; initialHtml?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);

  function command(name: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    setHtml(editorRef.current?.innerHTML ?? "");
  }

  function createLink() {
    const url = window.prompt("Nhập liên kết https:// hoặc mailto:");
    if (url) command("createLink", url);
  }

  return <div className="rich-editor">
    <div className="rich-editor-toolbar" role="toolbar" aria-label="Định dạng nội dung">
      <button type="button" onClick={() => command("bold")} aria-label="In đậm"><Bold /></button>
      <button type="button" onClick={() => command("italic")} aria-label="In nghiêng"><Italic /></button>
      <button type="button" onClick={() => command("insertUnorderedList")} aria-label="Danh sách dấu chấm"><List /></button>
      <button type="button" onClick={() => command("insertOrderedList")} aria-label="Danh sách đánh số"><ListOrdered /></button>
      <button type="button" onClick={() => command("formatBlock", "blockquote")} aria-label="Trích dẫn"><Quote /></button>
      <button type="button" onClick={createLink} aria-label="Chèn liên kết"><Link2 /></button>
    </div>
    <div ref={editorRef} className="rich-editor-surface" contentEditable suppressContentEditableWarning onInput={(event) => setHtml(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: initialHtml }} />
    <input type="hidden" name={name} value={html} />
  </div>;
}
