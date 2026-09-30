import mongoose from "mongoose"

const orderModel=mongoose.Schema(
{
customer:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
farmer:{type:mongoose.Schema.Types.ObjectId,ref:'farmer',required:true},
market:{type:mongoose.Schema.Types.ObjectId,ref:'market',required:true},
pickupSlot:{type:mongoose.Schema.Types.ObjectId,ref:'pickupSlot',required:true},
pickupDate:{type:Date,required:true},
pickupStart:String,
pickupEnd:String,
cutoffAt:Date,
status:{type:String,enum:['PLACED','ACCEPTED','READY_FOR_PICKUP','COMPLETED','DECLINED','CANCELLED_BY_CUSTOMER','CANCELLED_BY_FARMER','EXPIRED'],default:'PLACED'},
totalAmount:{type:Number,required:true,min:0},
paymentMethod:{type:String,default:'PAY_AT_PICKUP'},
paymentStatus:{type:String,default:'UNPAID'},
declineReason:String,
cancelReason:String,
notes:String,
// 6-digit code shown to the customer (as a QR code too). The farmer must enter / scan it to complete the pickup.
// select:false so it never leaks into farmer order lists; customer queries opt in with .select('+pickupCode')
pickupCode:{type:String,select:false},
completedAt:Date, // when the farmer confirmed the handover
},
{
timestamps:true
}
)

orderModel.index({customer:1,createdAt:-1})
orderModel.index({farmer:1,status:1})
orderModel.index({farmer:1,pickupCode:1})

export default mongoose.model('order',orderModel)
