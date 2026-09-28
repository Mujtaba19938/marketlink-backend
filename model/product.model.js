import mongoose from "mongoose"

const productModel=mongoose.Schema(
{
farmer:{type:mongoose.Schema.Types.ObjectId,ref:'farmer',required:true},
category:{type:mongoose.Schema.Types.ObjectId,ref:'category',required:true},
name:{type:String,required:true,trim:true},
description:String,
price:{type:Number,required:true,min:[0.01,'Price must be greater than 0']},
unit:{type:String,required:true,enum:['kg','g','piece','dozen','bunch','litre','pack']},
quantity:{type:Number,required:true,min:[0,'Quantity cannot be negative']},
image:String,
imageType:{type:String,default:'cabbage'}, // illustration shown when no photo is uploaded
weeklyStock:{type:Number,default:0,min:[0,'Weekly stock cannot be negative']}, // recurring weekly stock template
availability:{type:String,enum:['AVAILABLE','SOLD_OUT','UNAVAILABLE'],default:'AVAILABLE'},
isActive:{type:Boolean,default:true},
isBlocked:{type:Boolean,default:false},
moderated:{type:Boolean,default:false}, // admin has reviewed this listing
},
{
timestamps:true
}
)

productModel.index({farmer:1})
productModel.index({category:1})
productModel.index({price:1})

export default mongoose.model('product',productModel)
