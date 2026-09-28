import mongoose from "mongoose"

// one cart per customer, products from ONE farmer only
const cartModel=mongoose.Schema(
{
customer:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true,unique:true},
farmer:{type:mongoose.Schema.Types.ObjectId,ref:'farmer'},
items:[{
    product:{type:mongoose.Schema.Types.ObjectId,ref:'product',required:true},
    quantity:{type:Number,required:true,min:[0.01,'Quantity must be greater than 0']},
}],
},
{
timestamps:true
}
)

export default mongoose.model('cart',cartModel)
