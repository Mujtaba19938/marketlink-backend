import mongoose from "mongoose"

// messages sent through the public Contact Us form
const contactMessageModel=mongoose.Schema(
{
name:{type:String,required:true,trim:true},
email:{type:String,required:true,lowercase:true,trim:true},
phone:String,
subject:String,
message:{type:String,required:true},
isRead:{type:Boolean,default:false},
},
{
timestamps:true
}
)

export default mongoose.model('contactMessage',contactMessageModel)
