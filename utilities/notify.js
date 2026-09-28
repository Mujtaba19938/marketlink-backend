import notificationModel from '../model/notification.model.js'

// best-effort: a notification failure should never break the order/review flow
const notify = async (userId, title, message, type = 'SYSTEM') => {
    try {
        await notificationModel.create({ user: userId, title, message, type })
    } catch (err) {
        console.error('notification failed:', err.message)
    }
}

export default notify
