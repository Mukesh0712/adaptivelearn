// AI-written text that becomes course content (a summary added to a lesson,
// generated quiz questions) is later shown to students as normal Markdown,
// where links are clickable. A trick hidden in a lesson could make the AI
// slip in a link to a fake website, so links are turned into plain text
// here, before the instructor even sees the draft:
//   [text](https://…) and ![alt](https://…)  →  text / alt
//   (code like funcs[0](x) is left alone)
//   https://… or www.…                        →  (link removed)
export function stripLinks(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\(\s*<?(?:https?:|www\.|mailto:|data:|javascript:)[^)]*\)/gi, '$1')
    .replace(/\b(?:https?:\/\/|www\.)[^\s)>\]]+/gi, '(link removed)');
}
