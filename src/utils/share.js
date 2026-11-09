import { useState } from 'react'

/**
 * Share link utility — builds a deep link (?gun=<id>) for a catalog item.
 * Uses the Web Share API when available, otherwise copies to the clipboard.
 *
 * @param {Object} gun — product data { id, name }
 * @returns {{ share: Function, message: string, isSharing: boolean }}
 */
export const useShare = (gun) => {
  const [message, setMessage] = useState('')
  const [isSharing, setIsSharing] = useState(false)

  const flash = (text) => {
    setMessage(text)
    setTimeout(() => setMessage(''), 2500)
  }

  const share = async () => {
    if (!gun?.id) {
      flash('No product ID to share')
      return
    }

    const url = `${window.location.origin}/?gun=${gun.id}`
    setIsSharing(true)

    try {
      if (navigator.share) {
        await navigator.share({ title: gun.name, text: `Check out ${gun.name}`, url })
        flash('Shared!')
        return
      }
      await navigator.clipboard.writeText(url)
      flash('Link copied!')
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        flash('Link copied!')
      } catch {
        flash('Could not share link')
      }
    } finally {
      setIsSharing(false)
    }
  }

  return { share, message, isSharing }
}
