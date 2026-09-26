import bcrypt from 'bcryptjs';

const comparePassword=async(password,hashedPassword)=>{
      return bcrypt.compare(password,hashedPassword)
}

export default comparePassword