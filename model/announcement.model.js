import mongoose from "mongoose"

const announcementModel=mongoose.Schema(
{
title:{type:String,required:true},
message:{type:String,required:true},
targetAudience:{type:String,enum:['all','vendors','customers'],default:'all'},
priority:{type:String,enum:['normal','important','urgent'],default:'normal'},
isActive:{type:Boolean,default:true},
createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'user'},
},
{
timestamps:true
}
)

export default mongoose.model('announcement',announcementModel)
