import mongoose from "mongoose"

// snapshot of product name/unit/price at order time (old orders never change)
const orderItemModel=mongoose.Schema(
{
order:{type:mongoose.Schema.Types.ObjectId,ref:'order',required:true},
product:{type:mongoose.Schema.Types.ObjectId,ref:'product',required:true},
productName:{type:String,required:true},
unit:{type:String,required:true},
price:{type:Number,required:true,min:0},
quantity:{type:Number,required:true,min:0.01},
lineTotal:{type:Number,required:true,min:0},
},
{
timestamps:true
}
)

orderItemModel.index({order:1})

export default mongoose.model('orderItem',orderItemModel)
