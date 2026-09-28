import announcementModel from '../model/announcement.model.js'
import contactMessageModel from '../model/contactMessage.model.js'

const emailOk = (email) => typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email)

// GET /getAnnouncements?audience=customers|vendors -> active announcements for the site banner
const getActiveAnnouncements = async (req, res) => {
    const audience = ['customers', 'vendors'].includes(req.query.audience) ? req.query.audience : null
    const filter = { isActive: true }
    if (audience) filter.targetAudience = { $in: ['all', audience] }

    const announcements = await announcementModel.find(filter).sort({ createdAt: -1 }).limit(10)
    res.status(200).json({ success: true, announcements })
}

// POST /contact { name, email, phone?, subject?, message }
const submitContact = async (req, res) => {
    const { name, email, phone, subject, message } = req.body

    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, msg: 'Name is required' })
    if (!emailOk(email)) return res.status(400).json({ success: false, msg: 'Valid email is required' })
    if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ success: false, msg: 'Message is required' })

    await contactMessageModel.create({
        name: name.trim().slice(0, 100),
        email,
        phone: typeof phone === 'string' ? phone.trim().slice(0, 30) : undefined,
        subject: typeof subject === 'string' ? subject.trim().slice(0, 100) : undefined,
        message: message.trim().slice(0, 2000),
    })

    res.status(201).json({ success: true, msg: 'Thank you! Your message has been sent to the MarketLink team.' })
}

export { getActiveAnnouncements, submitContact }
