import mongoose from "mongoose"

const categoryModel=mongoose.Schema(
{
name:{type:String,required:true,unique:true,trim:true},
description:String,
badgeColor:String,
iconName:String,
isActive:{type:Boolean,default:true},
},
{
timestamps:true
}
)

export default mongoose.model('category',categoryModel)
