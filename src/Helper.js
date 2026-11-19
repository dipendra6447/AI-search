/**
 * Parses markdown text into structured blocks:
 * - code blocks (with language, code text)
 * - headings (#, ##, ###, or **Heading:**)
 * - bullet lists (* or -)
 * - numbered lists (1. 2.)
 * - regular paragraphs
 */
export function parseMarkdownBlocks(text) {
  if (!text) return []

  const lines = text.split('\n')
  const blocks = []
  let inCodeBlock = false
  let codeLang = ''
  let codeLines = []
  let currentParagraph = []

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: currentParagraph.join('\n')
      })
      currentParagraph = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check code fence (e.g. ```javascript or ```)
    const codeFenceMatch = line.match(/^```([a-zA-Z0-9_-]*)/)
    if (codeFenceMatch) {
      if (!inCodeBlock) {
        // Opening code block
        flushParagraph()
        inCodeBlock = true
        codeLang = codeFenceMatch[1] || ''
        codeLines = []
      } else {
        // Closing code block
        inCodeBlock = false
        blocks.push({
          type: 'code',
          lang: codeLang,
          code: codeLines.join('\n')
        })
        codeLines = []
        codeLang = ''
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Markdown Heading: #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2]
      })
      continue
    }

    // Standalone bold heading: **Title** or **Title:**
    const standaloneHeading = line.trim().match(/^\*\*([^*]+)\*\*[:]?$/)
    if (standaloneHeading) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: 2,
        text: standaloneHeading[1]
      })
      continue
    }

    // Bullet list item: * or - or •
    const bulletMatch = line.match(/^(\s*)[*•-]\s+(.*)$/)
    if (bulletMatch) {
      flushParagraph()
      blocks.push({
        type: 'bullet',
        indent: bulletMatch[1].length,
        text: bulletMatch[2]
      })
      continue
    }

    // Numbered list item: 1. or 2.
    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      flushParagraph()
      blocks.push({
        type: 'numbered',
        number: numberedMatch[2],
        indent: numberedMatch[1].length,
        text: numberedMatch[3]
      })
      continue
    }

    // Empty line separates paragraphs
    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    // Regular line in paragraph
    currentParagraph.push(line)
  }

  // Handle open code block while typing/streaming
  if (inCodeBlock) {
    blocks.push({
      type: 'code',
      lang: codeLang,
      code: codeLines.join('\n')
    })
  }

  flushParagraph()

  return blocks
}
