import mongoose from "mongoose"

const marketModel=mongoose.Schema(
{
name:{type:String,required:true,unique:true,trim:true},
description:String,
address:{type:String,required:true},
city:String,
latitude:{type:Number,min:-90,max:90},
longitude:{type:Number,min:-180,max:180},
operatingDays:[{type:String,enum:['MON','TUE','WED','THU','FRI','SAT','SUN']}],
timings:String, // e.g. "08:00 - 14:00"
status:{type:String,enum:['open','closed','seasonal'],default:'open'},
isActive:{type:Boolean,default:true}, // false = removed by admin
},
{
timestamps:true
}
)

export default mongoose.model('market',marketModel)
