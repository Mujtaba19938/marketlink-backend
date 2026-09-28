import mongoose from 'mongoose'
import notificationModel from '../model/notification.model.js'

const getMyNotifications = async (req, res) => {
    const notifications = await notificationModel.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
    const unreadCount = await notificationModel.countDocuments({ user: req.user._id, isRead: false })
    res.status(200).json({ success: true, unreadCount, notifications })
}

const markRead = async (req, res) => {
    const { notificationId } = req.body
    if (!mongoose.isValidObjectId(notificationId)) return res.status(400).json({ success: false, msg: 'Valid notificationId is required' })

    const result = await notificationModel.updateOne({ _id: notificationId, user: req.user._id }, { $set: { isRead: true } })
    if (result.matchedCount === 0) return res.status(404).json({ success: false, msg: 'Notification not found' })

    res.status(200).json({ success: true, msg: 'Marked as read' })
}

const markAllRead = async (req, res) => {
    await notificationModel.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } })
    res.status(200).json({ success: true, msg: 'All notifications marked as read' })
}

export { getMyNotifications, markRead, markAllRead }
