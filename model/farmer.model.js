import mongoose from "mongoose"

const farmerModel=mongoose.Schema(
{
user:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true,unique:true},
stallName:{type:String,required:true,trim:true},
description:String,
address:String,
city:String,
latitude:{type:Number,min:-90,max:90},
longitude:{type:Number,min:-180,max:180},
image:String,
approvalStatus:{type:String,enum:['PENDING','APPROVED','REJECTED','SUSPENDED'],default:'PENDING'},
statusReason:String,
autoResetWeeklyStock:{type:Boolean,default:false},
lastStockResetAt:Date,
},
{
timestamps:true
}
)

farmerModel.index({approvalStatus:1})

export default mongoose.model('farmer',farmerModel)
