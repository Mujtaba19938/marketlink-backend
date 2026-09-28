import bcrypt from 'bcryptjs'

const comparePassword = async (pwd, hashpwd) => {
    return await bcrypt.compare(pwd, hashpwd)
}

export default comparePassword
