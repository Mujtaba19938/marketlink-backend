import mongoose from "mongoose"

const productSaleModel=mongoose.Schema(
    {        
productName:String,
productLine:String,
productScale:String,
productVendor:String,
productDescription:String,
quantityInStock:Number,
buyPrice:Number,
MSRP:String,
image:String,
productID:Number,
saleQty:Number
},
{
    timestamps:true
}
)

export default mongoose.model('productsale',productSaleModel)