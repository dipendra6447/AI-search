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

    // Empty line separates paragraphs
    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    // Markdown Headings (e.g. ### Heading or ## Heading or # Heading)
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

    // Bold standalone line as pseudo-heading (e.g. **1. Step Name:** or **Important:**)
    const boldHeadingMatch = line.match(/^\*\*([^*]+)\*\*:?$/)
    if (boldHeadingMatch && line.length < 80) {
      flushParagraph()
      blocks.push({
        type: 'heading',
        level: 3,
        text: boldHeadingMatch[1]
      })
      continue
    }

    // Bullet lists (* item, - item, • item)
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/)
    if (bulletMatch) {
      flushParagraph()
      blocks.push({
        type: 'bullet',
        text: bulletMatch[1]
      })
      continue
    }

    // Numbered lists (1. item, 2. item)
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      flushParagraph()
      blocks.push({
        type: 'numbered',
        number: numberedMatch[1],
        text: numberedMatch[2]
      })
      continue
    }

    // Regular line - add to current paragraph
    currentParagraph.push(line)
  }

  // Flush any remaining paragraph or unclosed code block
  flushParagraph()
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({
      type: 'code',
      lang: codeLang,
      code: codeLines.join('\n')
    })
  }

  return blocks
}
