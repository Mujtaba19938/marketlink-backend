import mongoose from "mongoose"

const notificationModel=mongoose.Schema(
{
user:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
title:{type:String,required:true},
message:String,
type:{type:String,enum:['ORDER','FARMER','SYSTEM'],default:'SYSTEM'},
isRead:{type:Boolean,default:false},
},
{
timestamps:true
}
)

notificationModel.index({user:1,createdAt:-1})

export default mongoose.model('notification',notificationModel)
