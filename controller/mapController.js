import stallLocationModel from '../model/stallLocation.model.js';

export const getMarketStalls = async (req, res) => {
  try {
    const { marketId } = req.params;
    const query = marketId && marketId !== 'all' ? { marketId } : {};
    const stalls = await stallLocationModel.find(query);
    res.json({ success: true, stalls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAllStallsGrouped = async (req, res) => {
  try {
    const stalls = await stallLocationModel.find();
    const grouped = {};
    stalls.forEach((s) => {
      const mId = s.marketId || 'mkt-1';
      if (!grouped[mId]) grouped[mId] = [];
      grouped[mId].push(s);
    });
    res.json({ success: true, marketStalls: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getMarketStalls,
  getAllStallsGrouped,
};
