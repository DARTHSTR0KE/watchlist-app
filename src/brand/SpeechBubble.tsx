/**
 * What an animal is saying, above its head. Sized to the message rather
 * than fixed, because forty characters is a short line and four is a
 * shorter one.
 */
export function SpeechBubble({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`speech-bubble${className ? ` ${className}` : ''}`} role="status">
      <p className="speech-text">{text}</p>
      <span className="speech-tail" aria-hidden="true" />
    </div>
  )
}
