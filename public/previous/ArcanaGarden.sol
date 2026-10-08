// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Sepolia classroom game. ARCA is a test token, not redeemable for money.
/// @dev Future block hashes are demo entropy, NOT secure randomness for assets of value.
contract ArcanaGarden {
    string public constant name = "Arcana Petals";
    string public constant symbol = "ARCA";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public claimable;
    uint256 public flowerCount;
    address public operator;
    uint256 public constant INITIAL_RESERVE = 1_000_000 ether;
    uint256 public poolReserve;
    uint256 public reservedRewards;
    uint256 public siteRevenue;
    uint256 public totalSiteRevenue;
    uint256 public totalFlowerPayouts;
    uint256 public totalClaims;
    uint256 public constant ARCA_PER_ETH = 100_000;
    uint256 public constant MIN_EXCHANGE = 0.0001 ether;
    uint256 public constant MAX_EXCHANGE = 0.1 ether;
    uint256 public ethRevenue;
    uint256 public totalEthReceived;
    bool private withdrawingEth;
    event ArcaPurchased(address indexed keeper, uint256 ethPaid, uint256 arcaReceived);
    event EthRevenueWithdrawn(address indexed operator, uint256 amount);
    event RevenueWithdrawn(address indexed operator, uint256 amount);
    event ReserveFunded(address indexed funder, uint256 amount);
    event PurchaseSplit(uint256 siteFee, uint256 poolContribution);
    uint256 public constant STARTER_PETALS = 100 ether;
    mapping(address => bool) public starterClaimed;
    mapping(address => mapping(uint8 => mapping(uint8 => uint256))) public potions;
    event StarterClaimed(address indexed keeper, uint256 amount);
    event SeedPlanted(uint256 indexed id, address indexed keeper, uint8 species);
    event PotionsPurchased(address indexed keeper, uint8 tier, uint8 infusion, uint256 quantity, uint256 cost);
    event FlowerWatered(uint256 indexed id, uint8 tier, uint8 infusion, uint256 revealBlock);
    struct Flower {
        address keeper;
        uint256 plantedBlock;
        uint256 revealBlock;
        uint8 species;
        uint8 infusion;
        uint8 tier;
        uint8 rarity;
        bool watered;
        bool revealed;
        bool sold;
    }
    mapping(uint256 => Flower) public flowers;
    mapping(address => uint256[]) private gardens;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event BloomRevealed(uint256 indexed id, uint8 rarity, bool expired);
    event FlowerSold(uint256 indexed id, address indexed keeper, uint256 reward);
    event PetalsClaimed(address indexed keeper, uint256 amount);

    constructor() {
        require(block.chainid == 11155111 || block.chainid == 1337 || block.chainid == 31337, "Sepolia or local only");
        operator = msg.sender;
        poolReserve = INITIAL_RESERVE;
        _mint(address(this), INITIAL_RESERVE);
    }

    function gardenSize(address keeper) external view returns (uint256) { return gardens[keeper].length; }
    function gardenId(address keeper, uint256 index) external view returns (uint256) { return gardens[keeper][index]; }

    function quoteArca(uint256 ethAmount) public pure returns (uint256) {
        require(ethAmount >= MIN_EXCHANGE && ethAmount <= MAX_EXCHANGE, "Exchange: 0.0001 to 0.1 ETH");
        return ethAmount * ARCA_PER_ETH;
    }

    /// @notice One-way Sepolia test ETH purchase, not an ETH redemption promise.
    /// The buyer receives newly issued ARCA; game buyback reserves stay separate.
    function buyArca(uint256 minimumArca) external payable {
        uint256 tokens = quoteArca(msg.value);
        require(tokens >= minimumArca, "Exchange quote changed");
        ethRevenue += msg.value;
        totalEthReceived += msg.value;
        _mint(msg.sender, tokens);
        emit ArcaPurchased(msg.sender, msg.value, tokens);
    }

    /// @notice Only the deploying operator can collect received test ETH.
    function claimEthRevenue(uint256 amount) external {
        require(msg.sender == operator, "Operator only");
        require(!withdrawingEth, "Withdrawal in progress");
        require(amount > 0 && amount <= ethRevenue, "Invalid ETH amount");
        withdrawingEth = true;
        ethRevenue -= amount;
        (bool ok,) = payable(operator).call{value: amount}("");
        require(ok, "ETH transfer failed");
        withdrawingEth = false;
        emit EthRevenueWithdrawn(operator, amount);
    }

    /// @notice Testnet starter grant. One per wallet, not a proof of unique personhood.
    function claimStarter() external {
        require(!starterClaimed[msg.sender], "Starter already claimed");
        starterClaimed[msg.sender] = true;
        _mint(msg.sender, STARTER_PETALS);
        emit StarterClaimed(msg.sender, STARTER_PETALS);
    }

    /// @notice Seeds cost no ARCA; users still pay network gas to plant.
    function plantSeed(uint8 species) external returns (uint256 id) {
        require(species < 5, "Unknown seed");
        id = flowerCount++;
        flowers[id] = Flower(msg.sender, block.number, 0, species, 0, 0, 0, false, false, false);
        gardens[msg.sender].push(id);
        emit SeedPlanted(id, msg.sender, species);
    }

    function potionPrice(uint8 tier) public pure returns (uint256) {
        require(tier < 4, "Unknown potion");
        uint256 price = uint256(60) << tier;
        return price * 1 ether;
    }

    /// @notice The token contract is also the shop; only the caller's ARCA can be spent.
    /// No allowance or ETH purchase is required. 10% is site revenue; 90% funds buybacks.
    function buyPotions(uint8 tier, uint8 infusion, uint256 quantity) external {
        require(infusion < 3, "Unknown infusion");
        require(quantity > 0 && quantity <= 20, "Quantity: 1 to 20");
        uint256 cost = potionPrice(tier) * quantity;
        require(balanceOf[msg.sender] >= cost, "Not enough ARCA");
        uint256 fee = cost / 10;
        uint256 contribution = cost - fee;
        uint256 liability = rewardFor(tier, 3) * quantity;
        require(poolReserve + contribution >= reservedRewards + liability, "Buyback reserve full");
        _transfer(msg.sender, address(this), cost);
        poolReserve += contribution;
        reservedRewards += liability;
        siteRevenue += fee;
        totalSiteRevenue += fee;
        emit PurchaseSplit(fee, contribution);
        potions[msg.sender][tier][infusion] += quantity;
        emit PotionsPurchased(msg.sender, tier, infusion, quantity, cost);
    }

    function waterFlower(uint256 id, uint8 tier, uint8 infusion) external {
        Flower storage f = flowers[id];
        require(f.keeper == msg.sender, "Not your flower");
        require(!f.watered && !f.sold, "Already watered");
        require(tier < 4 && infusion < 3, "Unknown recipe");
        require(potions[msg.sender][tier][infusion] > 0, "No potion in satchel");
        potions[msg.sender][tier][infusion] -= 1;
        f.watered = true;
        f.tier = tier;
        f.infusion = infusion;
        f.revealBlock = block.number + 2;
        emit FlowerWatered(id, tier, infusion, f.revealBlock);
    }

    function rarityForRoll(uint256 roll) public pure returns (uint8) {
        require(roll < 10000, "Roll out of range");
        return roll < 7500 ? 0 : roll < 9500 ? 1 : roll < 9900 ? 2 : 3;
    }

    /// @notice Anyone may preserve a flower's outcome; only its keeper can sell it.
    /// After 256 blocks an unpreserved bloom becomes Common, never a new random roll.
    function revealBloom(uint256 id) public returns (uint8 rarity) {
        Flower storage f = flowers[id];
        require(f.keeper != address(0), "Unknown flower");
        if (f.revealed) return f.rarity;
        bool expired;
        (rarity, expired) = _outcome(id, f);
        f.rarity = rarity;
        f.revealed = true;
        emit BloomRevealed(id, rarity, expired);
    }

    function _outcome(uint256 id, Flower storage f) private view returns (uint8, bool) {
        require(f.watered, "Water your seed first");
        require(block.number > f.revealBlock, "Still growing");
        if (block.number > f.revealBlock + 256) return (0, true);
        bytes32 entropy = blockhash(f.revealBlock);
        require(entropy != bytes32(0), "Bloom block unavailable");
        uint256 roll = uint256(keccak256(abi.encode(entropy, id, f.keeper, address(this), block.chainid))) % 10000;
        return (rarityForRoll(roll), false);
    }

    function previewBloom(uint256 id) external view returns (bool ready, uint8 rarity, uint256 reward, bool expired) {
        Flower storage f = flowers[id];
        require(f.keeper != address(0), "Unknown flower");
        if (!f.watered || (!f.revealed && block.number <= f.revealBlock)) return (false, 0, 0, false);
        if (f.revealed) rarity = f.rarity;
        else (rarity, expired) = _outcome(id, f);
        return (true, rarity, rewardFor(f.tier, rarity), expired);
    }

    function rewardFor(uint8 tier, uint8 rarity) public pure returns (uint256) {
        require(tier < 4 && rarity < 4, "Unknown grade");
        uint256 base = rarity == 0 ? 40 : rarity == 1 ? 60 : rarity == 2 ? 150 : 400;
        return (base << tier) * 1 ether;
    }

    /// @notice Sale preserves the mutation and credits ARCA; a separate claim sends tokens.
    function sellToPip(uint256 id, uint256 minimumReward) external {
        Flower storage f = flowers[id];
        require(f.keeper == msg.sender, "Not your flower");
        require(!f.sold, "Already sold");
        uint8 rarity = revealBloom(id);
        uint256 reward = rewardFor(f.tier, rarity);
        require(reward >= minimumReward, "Offer changed: refresh bloom");
        f.sold = true;
        claimable[msg.sender] += reward;
        poolReserve -= reward;
        reservedRewards -= rewardFor(f.tier, 3);
        totalClaims += reward;
        totalFlowerPayouts += reward;
        emit FlowerSold(id, msg.sender, reward);
    }

    function claimPetals(uint256 amount) external {
        require(amount > 0 && amount <= claimable[msg.sender], "Invalid withdrawal amount");
        claimable[msg.sender] -= amount;
        totalClaims -= amount;
        _transfer(address(this), msg.sender, amount);
        emit PetalsClaimed(msg.sender, amount);
    }

    /// @notice Only earned fees can leave the site treasury; buyback reserves are protected.
    function claimSiteRevenue(uint256 amount) external {
        require(msg.sender == operator, "Operator only");
        require(amount > 0 && amount <= siteRevenue, "Invalid revenue amount");
        siteRevenue -= amount;
        _transfer(address(this), operator, amount);
        emit RevenueWithdrawn(operator, amount);
    }

    function fundReserve(uint256 amount) external {
        require(amount > 0, "Zero funding");
        _transfer(msg.sender, address(this), amount);
        poolReserve += amount;
        emit ReserveFunded(msg.sender, amount);
    }

    function availableReserve() external view returns (uint256) {
        return poolReserve - reservedRewards;
    }

    function _mint(address to, uint256 amount) private {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function approve(address spender, uint256 amount) external returns (bool) {
        require(spender != address(0), "Zero spender");
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "Insufficient allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
            emit Approval(from, msg.sender, allowed - amount);
        }
        _transfer(from, to, amount);
        return true;
    }
    function _transfer(address from, address to, uint256 amount) private {
        require(to != address(0), "Zero recipient");
        require(balanceOf[from] >= amount, "Insufficient ARCA");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
