import bcrypt from 'bcryptjs'

const hashPassword = async (pwd) => {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(pwd, salt)
}

export default hashPassword
