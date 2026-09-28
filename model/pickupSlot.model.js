import mongoose from "mongoose"

const pickupSlotModel=mongoose.Schema(
{
farmerMarket:{type:mongoose.Schema.Types.ObjectId,ref:'farmerMarket',required:true},
dayOfWeek:{type:String,required:true,enum:['MON','TUE','WED','THU','FRI','SAT','SUN']},
startTime:{type:String,required:true},
endTime:{type:String,required:true},
capacity:{type:Number,required:true,min:1},
isActive:{type:Boolean,default:true},
},
{
timestamps:true
}
)

export default mongoose.model('pickupSlot',pickupSlotModel)
