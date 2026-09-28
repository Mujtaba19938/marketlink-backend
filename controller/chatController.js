import { askMarketLink } from '../services/chatService.js'

const chat = async (req, res) => {

    const { message } = req.body

    if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, msg: 'Message is required' })
    }

    const cleanMessage = message.trim()
    if (!cleanMessage) return res.status(400).json({ success: false, msg: 'Message cannot be empty' })
    if (cleanMessage.length > 500) return res.status(400).json({ success: false, msg: 'Message is too long' })

    const result = await askMarketLink(cleanMessage)

    res.status(200).json({ success: true, answer: result.answer })
}

export { chat }
