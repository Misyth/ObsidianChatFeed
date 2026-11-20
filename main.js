"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ChatNotesPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE_CHAT = "chat-note-view";
var EXTENSION = "chat";
var MARKER = /^<!--msg:(\S+?)(?: reply:(\S+?))?-->\s*$/;
function parse(data) {
  const messages = [];
  let current = null;
  let buffer = [];
  const flush = () => {
    if (current) {
      current.text = buffer.join("\n").trim();
      messages.push(current);
    }
    buffer = [];
  };
  for (const line of data.split("\n")) {
    const match = line.match(MARKER);
    if (match) {
      flush();
      current = { time: match[1], text: "" };
      if (match[2])
        current.reply = match[2];
    } else {
      buffer.push(line);
    }
  }
  flush();
  return messages;
}
function serialize(messages) {
  return messages.map((m) => `<!--msg:${m.time}${m.reply ? ` reply:${m.reply}` : ""}-->
${m.text}
`).join("\n");
}
function snippet(text, max = 100) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "\u2026" : flat;
}
var ChatView = class extends import_obsidian.TextFileView {
  constructor(leaf) {
    super(leaf);
    this.messages = [];
    this.renderComponent = null;
    this.messageEls = /* @__PURE__ */ new Map();
    this.replyingTo = null;
  }
  getViewType() {
    return VIEW_TYPE_CHAT;
  }
  getDisplayText() {
    var _a, _b;
    return (_b = (_a = this.file) == null ? void 0 : _a.basename) != null ? _b : "Chat";
  }
  getIcon() {
    return "message-square";
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("chat-note-root");
    this.listEl = root.createDiv({ cls: "chat-note-list" });
    const wrap = root.createDiv({ cls: "chat-note-composer-wrap" });
    this.replyBarEl = wrap.createDiv({ cls: "chat-note-replybar" });
    this.replyBarEl.hide();
    const composer = wrap.createDiv({ cls: "chat-note-composer" });
    this.inputEl = composer.createEl("textarea", {
      cls: "chat-note-input",
      attr: { placeholder: "Write a message\u2026  (Enter to send, Shift+Enter for new line)", rows: "1" }
    });
    const sendBtn = composer.createEl("button", {
      cls: "chat-note-send mod-cta",
      attr: { "aria-label": "Send" }
    });
    (0, import_obsidian.setIcon)(sendBtn, "send");
    this.inputEl.addEventListener("input", () => this.autosize());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        void this.send();
      } else if (e.key === "Escape" && this.replyingTo) {
        e.preventDefault();
        this.setReplyTarget(null);
      }
    });
    sendBtn.addEventListener("click", () => void this.send());
    await this.renderAll();
  }
  async onClose() {
    var _a;
    (_a = this.renderComponent) == null ? void 0 : _a.unload();
  }
  /* TextFileView hooks */
  getViewData() {
    return serialize(this.messages);
  }
  setViewData(data, _clear) {
    this.messages = parse(data);
    this.setReplyTarget(null);
    void this.renderAll();
  }
  clear() {
    var _a;
    this.messages = [];
    this.messageEls.clear();
    (_a = this.listEl) == null ? void 0 : _a.empty();
  }
  /* Reply state */
  setReplyTarget(message) {
    this.replyingTo = message;
    if (!this.replyBarEl)
      return;
    this.replyBarEl.empty();
    if (!message) {
      this.replyBarEl.hide();
      return;
    }
    this.replyBarEl.show();
    const icon = this.replyBarEl.createSpan({ cls: "chat-note-replybar-icon" });
    (0, import_obsidian.setIcon)(icon, "corner-up-left");
    const text = this.replyBarEl.createDiv({ cls: "chat-note-replybar-text" });
    text.createDiv({ cls: "chat-note-replybar-label", text: "Replying to" });
    text.createDiv({ cls: "chat-note-replybar-snippet", text: snippet(message.text) });
    const cancel = this.replyBarEl.createSpan({
      cls: "chat-note-replybar-cancel clickable-icon",
      attr: { "aria-label": "Cancel reply" }
    });
    (0, import_obsidian.setIcon)(cancel, "x");
    cancel.addEventListener("click", () => {
      this.setReplyTarget(null);
      this.inputEl.focus();
    });
    this.inputEl.focus();
  }
  /* Rendering */
  async renderAll() {
    var _a;
    if (!this.listEl)
      return;
    (_a = this.renderComponent) == null ? void 0 : _a.unload();
    this.renderComponent = new import_obsidian.Component();
    this.renderComponent.load();
    this.listEl.empty();
    this.messageEls.clear();
    if (this.messages.length === 0) {
      this.listEl.createDiv({ cls: "chat-note-empty", text: "No messages yet. Say something!" });
    }
    for (const m of this.messages) {
      await this.renderMessage(m);
    }
    this.scrollToBottom();
  }
  async renderMessage(message) {
    var _a, _b, _c;
    const row = this.listEl.createDiv({ cls: "chat-note-message" });
    this.messageEls.set(message.time, row);
    const header = row.createDiv({ cls: "chat-note-meta" });
    header.createSpan({
      cls: "chat-note-time",
      text: (0, import_obsidian.moment)(message.time).format("MMM D, HH:mm")
    });
    const actions = header.createDiv({ cls: "chat-note-actions" });
    const replyBtn = actions.createSpan({
      cls: "chat-note-action clickable-icon",
      attr: { "aria-label": "Reply" }
    });
    (0, import_obsidian.setIcon)(replyBtn, "corner-up-left");
    replyBtn.addEventListener("click", () => this.setReplyTarget(message));
    const del = actions.createSpan({
      cls: "chat-note-action clickable-icon",
      attr: { "aria-label": "Delete message" }
    });
    (0, import_obsidian.setIcon)(del, "trash-2");
    del.addEventListener("click", () => {
      const idx = this.messages.indexOf(message);
      if (idx === -1)
        return;
      this.messages.splice(idx, 1);
      if (this.replyingTo === message)
        this.setReplyTarget(null);
      this.requestSave();
      void this.renderAll();
    });
    if (message.reply) {
      const parent = this.messages.find((m) => m.time === message.reply);
      const quote = row.createDiv({ cls: "chat-note-quote" });
      if (parent) {
        quote.addClass("is-clickable");
        quote.createDiv({
          cls: "chat-note-quote-time",
          text: (0, import_obsidian.moment)(parent.time).format("MMM D, HH:mm")
        });
        quote.createDiv({ cls: "chat-note-quote-text", text: snippet(parent.text) });
        quote.addEventListener("click", () => this.scrollToMessage(parent.time));
      } else {
        quote.addClass("is-missing");
        quote.createDiv({ cls: "chat-note-quote-text", text: "Original message deleted" });
      }
    }
    const body = row.createDiv({ cls: "chat-note-body markdown-rendered" });
    await import_obsidian.MarkdownRenderer.render(
      this.app,
      message.text,
      body,
      (_b = (_a = this.file) == null ? void 0 : _a.path) != null ? _b : "",
      (_c = this.renderComponent) != null ? _c : this
    );
  }
  scrollToMessage(id) {
    const el = this.messageEls.get(id);
    if (!el)
      return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.addClass("chat-note-flash");
    window.setTimeout(() => el.removeClass("chat-note-flash"), 1500);
  }
  scrollToBottom() {
    const go = () => {
      this.listEl.scrollTop = this.listEl.scrollHeight;
    };
    go();
    requestAnimationFrame(go);
    setTimeout(go, 100);
  }
  autosize() {
    this.inputEl.style.height = "auto";
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 200) + "px";
  }
  async send() {
    var _a;
    const text = this.inputEl.value.trim();
    if (!text)
      return;
    const message = { time: (/* @__PURE__ */ new Date()).toISOString(), text };
    if (this.replyingTo)
      message.reply = this.replyingTo.time;
    this.messages.push(message);
    this.requestSave();
    this.inputEl.value = "";
    this.autosize();
    this.setReplyTarget(null);
    (_a = this.listEl.querySelector(".chat-note-empty")) == null ? void 0 : _a.remove();
    await this.renderMessage(message);
    this.scrollToBottom();
    this.inputEl.focus();
  }
};
var ChatNotesPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf));
    this.registerExtensions([EXTENSION], VIEW_TYPE_CHAT);
    this.addRibbonIcon("message-square", "New chat note", () => void this.createChatNote());
    this.addCommand({
      id: "new-chat-note",
      name: "Create new chat note",
      callback: () => void this.createChatNote()
    });
  }
  async createChatNote() {
    var _a;
    const active = this.app.workspace.getActiveFile();
    const folder = this.app.fileManager.getNewFileParent((_a = active == null ? void 0 : active.path) != null ? _a : "");
    const prefix = folder.path === "/" || folder.path === "" ? "" : folder.path + "/";
    let path = `${prefix}Chat.${EXTENSION}`;
    for (let i = 1; this.app.vault.getAbstractFileByPath(path); i++) {
      path = `${prefix}Chat ${i}.${EXTENSION}`;
    }
    const file = await this.app.vault.create(path, "");
    await this.app.workspace.getLeaf(true).openFile(file);
  }
};
