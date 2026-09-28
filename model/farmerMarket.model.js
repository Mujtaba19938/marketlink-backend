import mongoose from "mongoose"

// which farmer sells at which market, on which days, with which cutoff
const farmerMarketModel=mongoose.Schema(
{
farmer:{type:mongoose.Schema.Types.ObjectId,ref:'farmer',required:true},
market:{type:mongoose.Schema.Types.ObjectId,ref:'market',required:true},
operatingDays:[{type:String,enum:['MON','TUE','WED','THU','FRI','SAT','SUN']}],
pickupStart:String,
pickupEnd:String,
cutoffHours:{type:Number,default:12,min:0},
stallNumber:String,
latitude:{type:Number,min:-90,max:90}, // stall pin inside the market (optional)
longitude:{type:Number,min:-180,max:180},
isActive:{type:Boolean,default:true},
},
{
timestamps:true
}
)

farmerMarketModel.index({farmer:1,market:1},{unique:true})

export default mongoose.model('farmerMarket',farmerMarketModel)
