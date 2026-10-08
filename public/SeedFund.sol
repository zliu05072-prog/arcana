// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title SeedFund - goal-based crowdfunding for the Sepolia classroom demo.
/// @notice No admin, platform fee, upgrade mechanism, or external oracle.
contract SeedFund {
    struct Campaign {
        address creator;
        string title;
        string description;
        uint256 goal;
        uint256 deadline;
        uint256 raised;
        uint256 backers;
        bool withdrawn;
    }

    Campaign[] private campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    bool private entered;

    event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goal, uint256 deadline);
    event Funded(uint256 indexed id, address indexed backer, uint256 amount);
    event Withdrawn(uint256 indexed id, address indexed creator, uint256 amount);
    event Refunded(uint256 indexed id, address indexed backer, uint256 amount);

    modifier validCampaign(uint256 id) {
        require(id < campaigns.length, "Campaign not found");
        _;
    }

    modifier nonReentrant() {
        require(!entered, "Reentrant call");
        entered = true;
        _;
        entered = false;
    }

    function campaignCount() external view returns (uint256) { return campaigns.length; }

    function getCampaign(uint256 id) external view validCampaign(id) returns (Campaign memory) {
        return campaigns[id];
    }

    function createCampaign(string calldata title, string calldata description, uint256 goal, uint256 durationMinutes) external returns (uint256 id) {
        require(bytes(title).length > 0 && bytes(title).length <= 80, "Title: 1-80 bytes");
        require(bytes(description).length <= 500, "Description too long");
        require(goal > 0, "Goal must be positive");
        require(durationMinutes >= 1 && durationMinutes <= 43200, "Duration: 1 minute to 30 days");
        uint256 deadline = block.timestamp + durationMinutes * 1 minutes;
        id = campaigns.length;
        campaigns.push(Campaign(msg.sender, title, description, goal, deadline, 0, 0, false));
        emit CampaignCreated(id, msg.sender, title, goal, deadline);
    }

    function fund(uint256 id) external payable validCampaign(id) {
        Campaign storage c = campaigns[id];
        require(block.timestamp < c.deadline, "Campaign ended");
        require(!c.withdrawn && c.raised < c.goal, "Goal already reached");
        require(msg.value > 0, "Contribution must be positive");
        require(msg.value <= c.goal - c.raised, "Exceeds remaining goal");
        if (contributions[id][msg.sender] == 0) c.backers++;
        contributions[id][msg.sender] += msg.value;
        c.raised += msg.value;
        emit Funded(id, msg.sender, msg.value);
    }

    /// @notice Success is final as soon as the goal is reached; no wait is required.
    function withdraw(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        require(msg.sender == c.creator, "Only creator");
        require(c.raised >= c.goal, "Goal not reached");
        require(!c.withdrawn, "Already withdrawn");
        c.withdrawn = true;
        uint256 amount = c.raised;
        (bool sent,) = payable(c.creator).call{value: amount}("");
        require(sent, "Transfer failed");
        emit Withdrawn(id, c.creator, amount);
    }

    /// @notice Pull refunds avoid looping through or paying every backer at once.
    function refund(uint256 id) external validCampaign(id) nonReentrant {
        Campaign storage c = campaigns[id];
        require(block.timestamp >= c.deadline && c.raised < c.goal, "Refund unavailable");
        uint256 amount = contributions[id][msg.sender];
        require(amount > 0, "Nothing to refund");
        contributions[id][msg.sender] = 0;
        // raised is historical gross funding, so success/failure never changes after expiry.
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");
        emit Refunded(id, msg.sender, amount);
    }
}
