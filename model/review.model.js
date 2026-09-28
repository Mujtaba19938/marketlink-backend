import mongoose from "mongoose"

const reviewModel=mongoose.Schema(
{
customer:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
product:{type:mongoose.Schema.Types.ObjectId,ref:'product',required:true},
farmer:{type:mongoose.Schema.Types.ObjectId,ref:'farmer',required:true},
order:{type:mongoose.Schema.Types.ObjectId,ref:'order',required:true},
orderItem:{type:mongoose.Schema.Types.ObjectId,ref:'orderItem',required:true,unique:true},
rating:{type:Number,required:true,min:1,max:5},
comment:String,
farmerResponse:String,
status:{type:String,enum:['VISIBLE','HIDDEN'],default:'VISIBLE'},
moderated:{type:Boolean,default:false}, // admin has reviewed this review
},
{
timestamps:true
}
)

export default mongoose.model('review',reviewModel)
